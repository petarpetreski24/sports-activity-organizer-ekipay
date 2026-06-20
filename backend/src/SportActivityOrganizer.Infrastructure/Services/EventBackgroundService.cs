using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SportActivityOrganizer.Application.Interfaces;
using SportActivityOrganizer.Application.Interfaces.Persistence;
using SportActivityOrganizer.Domain.Enums;

namespace SportActivityOrganizer.Infrastructure.Services;

public class EventBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EventBackgroundService> _logger;

    public EventBackgroundService(IServiceScopeFactory scopeFactory, ILogger<EventBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("EventBackgroundService started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await MarkInProgressEvents(stoppingToken);
                await AutoCompleteExpiredEvents(stoppingToken);
                await SendEventReminders(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in EventBackgroundService.");
            }

            // Run every 5 minutes
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }

    private async Task MarkInProgressEvents(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var now = DateTime.UtcNow;

        // FR-3.5: an event is "in progress" between its start time and its end
        // (start + duration). Move Open/Full events into that state.
        var startingEvents = await unitOfWork.SportEvents.Query()
            .Where(e => (e.Status == EventStatus.Open || e.Status == EventStatus.Full) &&
                        e.EventDate <= now &&
                        e.EventDate.AddMinutes(e.DurationMinutes) > now)
            .ToListAsync(ct);

        if (startingEvents.Count > 0)
        {
            foreach (var evt in startingEvents)
            {
                evt.Status = EventStatus.InProgress;
                evt.UpdatedAt = now;
            }

            await unitOfWork.SaveChangesAsync(ct);
            _logger.LogInformation("Marked {Count} events as in progress.", startingEvents.Count);
        }
    }

    private async Task AutoCompleteExpiredEvents(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var now = DateTime.UtcNow;

        // Find events that have ended (EventDate + Duration < now) and are still active
        var expiredEvents = await unitOfWork.SportEvents.Query()
            .Where(e => (e.Status == EventStatus.Open || e.Status == EventStatus.Full || e.Status == EventStatus.InProgress) &&
                        e.EventDate.AddMinutes(e.DurationMinutes) < now)
            .ToListAsync(ct);

        if (expiredEvents.Count > 0)
        {
            foreach (var evt in expiredEvents)
            {
                evt.Status = EventStatus.Completed;
                evt.UpdatedAt = now;
            }

            await unitOfWork.SaveChangesAsync(ct);
            _logger.LogInformation("Auto-completed {Count} expired events.", expiredEvents.Count);
        }
    }

    private async Task SendEventReminders(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now = DateTime.UtcNow;
        var reminderWindowStart = now.AddHours(23.5);
        var reminderWindowEnd = now.AddHours(24.5);

        // Find events starting in ~24 hours
        var upcomingEvents = await unitOfWork.SportEvents.Query()
            .Include(e => e.Applications)
            .Where(e => (e.Status == EventStatus.Open || e.Status == EventStatus.Full) &&
                        e.EventDate >= reminderWindowStart &&
                        e.EventDate <= reminderWindowEnd)
            .ToListAsync(ct);

        foreach (var evt in upcomingEvents)
        {
            // Check if reminder already sent (by checking existing notifications)
            var alreadySent = await unitOfWork.Notifications.AnyAsync(n =>
                n.ReferenceEventId == evt.Id &&
                n.Type == NotificationType.EventReminder &&
                n.CreatedAt >= now.AddHours(-1), ct);

            if (alreadySent)
                continue;

            // Notify organizer
            await notificationService.CreateNotificationAsync(
                evt.OrganizerId,
                NotificationType.EventReminder,
                "Потсетник за настан",
                $"Вашиот настан \"{evt.Title}\" започнува за 24 часа!",
                evt.Id);

            // Notify all approved participants
            var approvedParticipantIds = evt.Applications
                .Where(a => a.Status == ApplicationStatus.Approved)
                .Select(a => a.UserId)
                .ToList();

            foreach (var participantId in approvedParticipantIds)
            {
                await notificationService.CreateNotificationAsync(
                    participantId,
                    NotificationType.EventReminder,
                    "Потсетник за настан",
                    $"Настанот \"{evt.Title}\" започнува за 24 часа!",
                    evt.Id);
            }

            _logger.LogInformation("Sent reminders for event {EventId}: {Title}", evt.Id, evt.Title);
        }
    }
}
