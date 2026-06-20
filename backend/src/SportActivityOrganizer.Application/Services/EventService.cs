using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SportActivityOrganizer.Application.DTOs.Events;
using SportActivityOrganizer.Application.Interfaces;
using SportActivityOrganizer.Application.Interfaces.Persistence;
using SportActivityOrganizer.Domain.Entities;
using SportActivityOrganizer.Domain.Enums;

namespace SportActivityOrganizer.Application.Services;

public class EventService : IEventService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public EventService(IUnitOfWork unitOfWork, IMapper mapper, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task<SportEventDto> CreateAsync(int organizerId, CreateEventRequest request)
    {
        var organizer = await _unitOfWork.Users.GetByIdAsync(organizerId);
        if (organizer == null)
            throw new KeyNotFoundException("Organizer not found.");

        var sport = await _unitOfWork.Sports.GetByIdAsync(request.SportId);
        if (sport == null)
            throw new KeyNotFoundException("Sport not found.");

        // Cannot create events in the past
        var eventDateUtc = DateTime.SpecifyKind(request.EventDate, DateTimeKind.Utc);
        if (eventDateUtc < DateTime.UtcNow)
            throw new ArgumentException("Не може да се креира настан во минатото.");

        SkillLevel? minSkillLevel = null;
        if (request.MinSkillLevel != null)
        {
            if (!Enum.TryParse<SkillLevel>(request.MinSkillLevel, true, out var parsed))
                throw new InvalidOperationException($"Invalid skill level: {request.MinSkillLevel}");
            minSkillLevel = parsed;
        }

        var sportEvent = new SportEvent
        {
            OrganizerId = organizerId,
            SportId = request.SportId,
            Title = request.Title,
            Description = request.Description ?? string.Empty,
            EventDate = DateTime.SpecifyKind(request.EventDate, DateTimeKind.Utc),
            DurationMinutes = request.DurationMinutes,
            LocationAddress = request.LocationAddress,
            LocationLat = (decimal)request.LocationLat,
            LocationLng = (decimal)request.LocationLng,
            MaxParticipants = request.MaxParticipants,
            MinSkillLevel = minSkillLevel,
            Status = EventStatus.Open,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.SportEvents.AddAsync(sportEvent);
        await _unitOfWork.SaveChangesAsync();

        // Reload with navigation properties
        var created = await _unitOfWork.SportEvents.Query()
            .Include(e => e.Organizer)
            .Include(e => e.Sport)
            .Include(e => e.Applications)
            .FirstAsync(e => e.Id == sportEvent.Id);

        return _mapper.Map<SportEventDto>(created);
    }

    public async Task<SportEventDto> GetByIdAsync(int eventId)
    {
        var sportEvent = await _unitOfWork.SportEvents.Query()
            .Include(e => e.Organizer)
            .Include(e => e.Sport)
            .Include(e => e.Applications)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (sportEvent == null)
            throw new KeyNotFoundException("Event not found.");

        return _mapper.Map<SportEventDto>(sportEvent);
    }

    public async Task<SportEventDto> UpdateAsync(int organizerId, int eventId, UpdateEventRequest request)
    {
        var sportEvent = await _unitOfWork.SportEvents.Query()
            .Include(e => e.Organizer)
            .Include(e => e.Sport)
            .Include(e => e.Applications)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (sportEvent == null)
            throw new KeyNotFoundException("Event not found.");

        if (sportEvent.OrganizerId != organizerId)
            throw new UnauthorizedAccessException("Only the organizer can update this event.");

        if (sportEvent.Status == EventStatus.Cancelled || sportEvent.Status == EventStatus.Completed)
            throw new InvalidOperationException("Cannot update a cancelled or completed event.");

        var sport = await _unitOfWork.Sports.GetByIdAsync(request.SportId);
        if (sport == null)
            throw new KeyNotFoundException("Sport not found.");

        SkillLevel? minSkillLevel = null;
        if (request.MinSkillLevel != null)
        {
            if (!Enum.TryParse<SkillLevel>(request.MinSkillLevel, true, out var parsed))
                throw new InvalidOperationException($"Invalid skill level: {request.MinSkillLevel}");
            minSkillLevel = parsed;
        }

        sportEvent.SportId = request.SportId;
        sportEvent.Title = request.Title;
        sportEvent.Description = request.Description ?? string.Empty;
        sportEvent.EventDate = DateTime.SpecifyKind(request.EventDate, DateTimeKind.Utc);
        sportEvent.DurationMinutes = request.DurationMinutes;
        sportEvent.LocationAddress = request.LocationAddress;
        sportEvent.LocationLat = (decimal)request.LocationLat;
        sportEvent.LocationLng = (decimal)request.LocationLng;
        sportEvent.MaxParticipants = request.MaxParticipants;
        sportEvent.MinSkillLevel = minSkillLevel;
        sportEvent.UpdatedAt = DateTime.UtcNow;

        // Reload sport navigation property
        sportEvent.Sport = sport;

        await _unitOfWork.SaveChangesAsync();

        // Notify all approved participants about event update
        var approvedParticipantIds = sportEvent.Applications?
            .Where(a => a.Status == ApplicationStatus.Approved)
            .Select(a => a.UserId)
            .ToList() ?? new List<int>();

        foreach (var participantId in approvedParticipantIds)
        {
            await _notificationService.CreateNotificationAsync(
                participantId,
                NotificationType.EventUpdated,
                "Настанот е ажуриран",
                $"Настанот \"{sportEvent.Title}\" е ажуриран од организаторот.",
                eventId);
        }

        return _mapper.Map<SportEventDto>(sportEvent);
    }

    public async Task CancelAsync(int organizerId, int eventId)
    {
        var sportEvent = await _unitOfWork.SportEvents.Query()
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (sportEvent == null)
            throw new KeyNotFoundException("Event not found.");

        if (sportEvent.OrganizerId != organizerId)
            throw new UnauthorizedAccessException("Only the organizer can cancel this event.");

        if (sportEvent.Status == EventStatus.Cancelled)
            throw new InvalidOperationException("Event is already cancelled.");

        if (sportEvent.Status == EventStatus.Completed)
            throw new InvalidOperationException("Cannot cancel a completed event.");

        sportEvent.Status = EventStatus.Cancelled;
        sportEvent.UpdatedAt = DateTime.UtcNow;

        // Cancel all pending/approved applications
        var activeApplications = await _unitOfWork.EventApplications.Query()
            .Where(ea => ea.EventId == eventId &&
                   (ea.Status == ApplicationStatus.Pending || ea.Status == ApplicationStatus.Approved))
            .ToListAsync();

        foreach (var application in activeApplications)
        {
            application.Status = ApplicationStatus.Cancelled;
            application.ResolvedAt = DateTime.UtcNow;
            application.UpdatedAt = DateTime.UtcNow;
        }

        await _unitOfWork.SaveChangesAsync();

        // Notify all affected participants about event cancellation
        foreach (var application in activeApplications)
        {
            await _notificationService.CreateNotificationAsync(
                application.UserId,
                NotificationType.EventCancelled,
                "Настанот е откажан",
                $"Настанот \"{sportEvent.Title}\" е откажан од организаторот.",
                eventId);
        }
    }

    public async Task<EventSearchResponse> SearchAsync(EventSearchRequest request)
    {
        var query = _unitOfWork.SportEvents.Query()
            .Include(e => e.Organizer)
            .Include(e => e.Sport)
            .Include(e => e.Applications)
            .AsQueryable();

        // Keyword filter
        if (!string.IsNullOrWhiteSpace(request.Keyword))
        {
            var keyword = request.Keyword.ToLower();
            query = query.Where(e =>
                e.Title.ToLower().Contains(keyword) ||
                e.Description.ToLower().Contains(keyword) ||
                e.LocationAddress.ToLower().Contains(keyword));
        }

        // Sport filter
        if (request.SportIds != null && request.SportIds.Count > 0)
        {
            query = query.Where(e => request.SportIds.Contains(e.SportId));
        }

        // Date range filter (ensure UTC kind for Npgsql compatibility)
        if (request.DateFrom.HasValue)
        {
            var dateFrom = DateTime.SpecifyKind(request.DateFrom.Value, DateTimeKind.Utc);
            query = query.Where(e => e.EventDate >= dateFrom);
        }

        if (request.DateTo.HasValue)
        {
            var dateTo = DateTime.SpecifyKind(request.DateTo.Value, DateTimeKind.Utc);
            query = query.Where(e => e.EventDate <= dateTo);
        }

        // Status filter — filter by specific statuses
        if (request.Statuses != null && request.Statuses.Count > 0)
        {
            var parsedStatuses = request.Statuses
                .Where(s => Enum.TryParse<EventStatus>(s, true, out _))
                .Select(s => Enum.Parse<EventStatus>(s, true))
                .ToList();
            if (parsedStatuses.Count > 0)
                query = query.Where(e => parsedStatuses.Contains(e.Status));
        }

        // Available only filter (Open or Full status, future date)
        if (request.AvailableOnly == true)
        {
            query = query.Where(e =>
                e.Status == EventStatus.Open &&
                e.EventDate > DateTime.UtcNow);
        }

        // Skill level filter — show events that require exactly this level (or have no requirement)
        if (!string.IsNullOrWhiteSpace(request.MinSkillLevel))
        {
            if (Enum.TryParse<SkillLevel>(request.MinSkillLevel, true, out var skillLevel))
            {
                query = query.Where(e => e.MinSkillLevel != null && e.MinSkillLevel == skillLevel);
            }
        }

        // Geo-distance filtering using bounding box approach then Haversine
        double? userLat = request.Lat;
        double? userLng = request.Lng;
        double radiusKm = request.RadiusKm ?? 50;

        if (userLat.HasValue && userLng.HasValue)
        {
            // Bounding box approximation: 1 degree latitude ~= 111 km
            var latDelta = (decimal)(radiusKm / 111.0);
            var lngDelta = (decimal)(radiusKm / (111.0 * Math.Cos(userLat.Value * Math.PI / 180.0)));

            var minLat = (decimal)userLat.Value - latDelta;
            var maxLat = (decimal)userLat.Value + latDelta;
            var minLng = (decimal)userLng.Value - lngDelta;
            var maxLng = (decimal)userLng.Value + lngDelta;

            query = query.Where(e =>
                e.LocationLat >= minLat && e.LocationLat <= maxLat &&
                e.LocationLng >= minLng && e.LocationLng <= maxLng);
        }

        var page = request.Page > 0 ? request.Page : 1;
        var pageSize = request.PageSize > 0 ? request.PageSize : 20;
        var sortBy = request.SortBy?.ToLower() ?? "date";

        List<SportEvent> pagedEvents;
        int totalCount;

        if (userLat.HasValue && userLng.HasValue)
        {
            // Geo search: the bounding box is already applied in the query, which
            // bounds the row count. Exact Haversine distance filtering and
            // distance sorting can only be done in memory, so materialise the
            // (already bounded) candidate set and then filter/sort/page it.
            var candidates = await query.ToListAsync();

            var filtered = candidates.Where(e =>
                CalculateHaversineDistance(
                    userLat.Value, userLng.Value,
                    (double)e.LocationLat, (double)e.LocationLng) <= radiusKm);

            IEnumerable<SportEvent> sorted = sortBy switch
            {
                "distance" => filtered.OrderBy(e => CalculateHaversineDistance(
                    userLat.Value, userLng.Value,
                    (double)e.LocationLat, (double)e.LocationLng)),
                "rating" => filtered.OrderByDescending(e => e.AvgRating ?? 0),
                _ => filtered.OrderBy(e => e.EventDate)
            };

            var sortedList = sorted.ToList();
            totalCount = sortedList.Count;
            pagedEvents = sortedList
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();
        }
        else
        {
            // Non-geo search: sort, count and page entirely at the database so we
            // never materialise more than one page of results.
            query = sortBy switch
            {
                "rating" => query.OrderByDescending(e => e.AvgRating ?? 0),
                _ => query.OrderBy(e => e.EventDate) // "date" default ("distance" needs geo)
            };

            totalCount = await query.CountAsync();
            pagedEvents = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        var items = _mapper.Map<List<SportEventDto>>(pagedEvents);

        return new EventSearchResponse(
            Items: items,
            TotalCount: totalCount,
            Page: page,
            PageSize: pageSize);
    }

    public async Task<List<SportEventDto>> GetMyEventsAsync(int userId, string? statusFilter, string? type)
    {
        var query = _unitOfWork.SportEvents.Query()
            .Include(e => e.Organizer)
            .Include(e => e.Sport)
            .Include(e => e.Applications)
            .AsQueryable();

        // Filter by type: organized, participating, or both
        if (string.Equals(type, "organized", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => e.OrganizerId == userId);
        }
        else if (string.Equals(type, "participating", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(e => e.Applications.Any(a => a.UserId == userId && a.Status == ApplicationStatus.Approved));
        }
        else
        {
            // Default: both organized and participating
            query = query.Where(e => e.OrganizerId == userId ||
                        e.Applications.Any(a => a.UserId == userId && a.Status == ApplicationStatus.Approved));
        }

        if (!string.IsNullOrWhiteSpace(statusFilter))
        {
            if (Enum.TryParse<EventStatus>(statusFilter, true, out var status))
            {
                query = query.Where(e => e.Status == status);
            }
        }

        var events = await query
            .OrderByDescending(e => e.EventDate)
            .ToListAsync();

        return _mapper.Map<List<SportEventDto>>(events);
    }

    public async Task<SportEventDto> ToggleLastMinuteAsync(int organizerId, int eventId)
    {
        var sportEvent = await _unitOfWork.SportEvents.Query()
            .Include(e => e.Organizer)
            .Include(e => e.Sport)
            .Include(e => e.Applications)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (sportEvent == null)
            throw new KeyNotFoundException("Event not found.");

        if (sportEvent.OrganizerId != organizerId)
            throw new UnauthorizedAccessException("Only the organizer can toggle last minute status.");

        if (sportEvent.Status != EventStatus.Open)
            throw new InvalidOperationException("Only open events can be marked as last minute.");

        if (sportEvent.EventDate <= DateTime.UtcNow)
            throw new InvalidOperationException("Cannot mark past events as last minute.");

        sportEvent.IsLastMinute = !sportEvent.IsLastMinute;
        sportEvent.LastMinuteAt = sportEvent.IsLastMinute ? DateTime.UtcNow : null;
        sportEvent.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<SportEventDto>(sportEvent);
    }

    public async Task<List<SportEventDto>> GetLastMinuteEventsAsync()
    {
        var events = await _unitOfWork.SportEvents.Query()
            .Include(e => e.Organizer)
            .Include(e => e.Sport)
            .Include(e => e.Applications)
            .Where(e => e.IsLastMinute && e.Status == EventStatus.Open && e.EventDate > DateTime.UtcNow)
            .OrderBy(e => e.EventDate)
            .Take(20)
            .ToListAsync();

        return _mapper.Map<List<SportEventDto>>(events);
    }

    private static double CalculateHaversineDistance(double lat1, double lng1, double lat2, double lng2)
    {
        const double R = 6371; // Earth's radius in km
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                Math.Sin(dLng / 2) * Math.Sin(dLng / 2);

        var c = 2 * Math.Asin(Math.Sqrt(a));
        return R * c;
    }

    private static double ToRadians(double degrees)
    {
        return degrees * Math.PI / 180.0;
    }
}
