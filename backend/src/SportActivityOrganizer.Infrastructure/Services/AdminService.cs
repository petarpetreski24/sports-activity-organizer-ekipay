using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SportActivityOrganizer.Application.DTOs.Admin;
using SportActivityOrganizer.Application.DTOs.Events;
using SportActivityOrganizer.Application.DTOs.Users;
using SportActivityOrganizer.Application.Interfaces;
using SportActivityOrganizer.Application.Interfaces.Persistence;
using SportActivityOrganizer.Domain.Entities;
using SportActivityOrganizer.Domain.Enums;

namespace SportActivityOrganizer.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public AdminService(IUnitOfWork unitOfWork, IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<AdminStatsDto> GetStatsAsync()
    {
        var totalUsers = await _unitOfWork.Users.CountAsync(_ => true);
        var totalEvents = await _unitOfWork.SportEvents.CountAsync(_ => true);
        var activeEvents = await _unitOfWork.SportEvents
            .CountAsync(e => e.Status == EventStatus.Open || e.Status == EventStatus.Full);
        var totalSports = await _unitOfWork.Sports.CountAsync(_ => true);
        var totalComments = await _unitOfWork.EventComments.CountAsync(c => !c.IsDeleted);
        var totalRatings = await _unitOfWork.EventRatings.CountAsync(_ => true);

        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var newUsersThisMonth = await _unitOfWork.Users.CountAsync(u => u.CreatedAt >= startOfMonth);
        var newEventsThisMonth = await _unitOfWork.SportEvents.CountAsync(e => e.CreatedAt >= startOfMonth);

        var topSportsRaw = await _unitOfWork.SportEvents.Query()
            .GroupBy(e => e.SportId)
            .Select(g => new { SportId = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(5)
            .ToListAsync();

        var sportNames = await _unitOfWork.Sports.Query()
            .Where(s => topSportsRaw.Select(x => x.SportId).Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name);

        var topSports = topSportsRaw
            .Select(x => new TopSportDto(sportNames.GetValueOrDefault(x.SportId, "Unknown"), x.Count))
            .ToList();

        return new AdminStatsDto(
            TotalUsers: totalUsers,
            TotalEvents: totalEvents,
            ActiveEvents: activeEvents,
            TotalSports: totalSports,
            TotalComments: totalComments,
            TotalRatings: totalRatings,
            NewUsersThisMonth: newUsersThisMonth,
            NewEventsThisMonth: newEventsThisMonth,
            TopSports: topSports);
    }

    public async Task<(List<AdminUserDto> Items, int TotalCount)> GetUsersAsync(string? search, string? role, int page, int pageSize)
    {
        var query = _unitOfWork.Users.Query()
            .Include(u => u.FavoriteSports)
                .ThenInclude(fs => fs.Sport)
            .AsQueryable();

        // Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(searchLower) ||
                u.LastName.ToLower().Contains(searchLower) ||
                u.Email.ToLower().Contains(searchLower));
        }

        // Role filter
        if (!string.IsNullOrWhiteSpace(role))
        {
            if (Enum.TryParse<UserRole>(role, true, out var userRole))
            {
                query = query.Where(u => u.Role == userRole);
            }
        }

        var totalCount = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Batch-load counts to fix N+1 query issue
        var userIds = users.Select(u => u.Id).ToList();

        var participationCounts = await _unitOfWork.EventApplications.Query()
            .Where(ea => userIds.Contains(ea.UserId) && ea.Status == ApplicationStatus.Approved)
            .GroupBy(ea => ea.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        var organizerCounts = await _unitOfWork.SportEvents.Query()
            .Where(e => userIds.Contains(e.OrganizerId))
            .GroupBy(e => e.OrganizerId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        var userDtos = new List<AdminUserDto>();

        foreach (var user in users)
        {
            participationCounts.TryGetValue(user.Id, out var totalParticipated);
            organizerCounts.TryGetValue(user.Id, out var totalOrganized);

            userDtos.Add(new AdminUserDto(
                Id: user.Id,
                FirstName: user.FirstName,
                LastName: user.LastName,
                Email: user.Email,
                Phone: user.Phone,
                Bio: user.Bio,
                ProfilePhotoUrl: user.ProfilePhotoUrl,
                LocationCity: user.LocationCity,
                LocationLat: user.LocationLat.HasValue ? (double)user.LocationLat.Value : null,
                LocationLng: user.LocationLng.HasValue ? (double)user.LocationLng.Value : null,
                Role: user.Role.ToString(),
                IsActive: user.IsActive,
                EmailConfirmed: user.EmailConfirmed,
                AvgRatingAsOrganizer: user.AvgRatingAsOrganizer.HasValue ? (double)user.AvgRatingAsOrganizer.Value : null,
                AvgRatingAsParticipant: user.AvgRatingAsParticipant.HasValue ? (double)user.AvgRatingAsParticipant.Value : null,
                FavoriteSports: _mapper.Map<List<UserFavoriteSportDto>>(user.FavoriteSports),
                CreatedAt: user.CreatedAt,
                TotalEventsParticipated: totalParticipated,
                TotalEventsOrganized: totalOrganized));
        }

        return (userDtos, totalCount);
    }

    public async Task DeactivateUserAsync(int userId)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId);

        if (user == null)
            throw new KeyNotFoundException("User not found.");

        if (user.Role == UserRole.Admin)
            throw new InvalidOperationException("Cannot deactivate an admin user.");

        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task DeleteUserAsync(int userId)
    {
        var user = await _unitOfWork.Users.GetByIdAsync(userId);

        if (user == null)
            throw new KeyNotFoundException("User not found.");

        if (user.Role == UserRole.Admin)
            throw new InvalidOperationException("Cannot delete an admin user.");

        // Cancel all active events organized by this user
        var activeEvents = await _unitOfWork.SportEvents.Query()
            .Where(e => e.OrganizerId == userId &&
                        (e.Status == EventStatus.Open || e.Status == EventStatus.Full))
            .ToListAsync();

        foreach (var sportEvent in activeEvents)
        {
            sportEvent.Status = EventStatus.Cancelled;
            sportEvent.UpdatedAt = DateTime.UtcNow;
        }

        // DBR-1.3: deleting a user must NOT remove related events/ratings.
        // Perform a soft delete — deactivate, anonymize personal data and
        // invalidate credentials, while keeping referential integrity.
        user.IsActive = false;
        user.FirstName = "Избришан";
        user.LastName = "корисник";
        user.Email = $"deleted_user_{user.Id}@deleted.local";
        user.Phone = null;
        user.Bio = null;
        user.ProfilePhotoUrl = null;
        user.LocationCity = null;
        user.LocationLat = null;
        user.LocationLng = null;
        user.PasswordHash = string.Empty;
        user.EmailConfirmationToken = null;
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.RefreshToken = null;
        user.RefreshTokenExpiry = null;
        user.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync();
    }

    public async Task DeleteEventAsync(int eventId)
    {
        var sportEvent = await _unitOfWork.SportEvents.Query()
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (sportEvent == null)
            throw new KeyNotFoundException("Event not found.");

        _unitOfWork.SportEvents.Remove(sportEvent);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task DeleteCommentAsync(int commentId)
    {
        var comment = await _unitOfWork.EventComments.Query()
            .FirstOrDefaultAsync(c => c.Id == commentId);

        if (comment == null)
            throw new KeyNotFoundException("Comment not found.");

        comment.IsDeleted = true;
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<SportEventDto> AdminCreateEventAsync(AdminCreateEventRequest request)
    {
        var organizer = await _unitOfWork.Users.GetByIdAsync(request.OrganizerId);
        if (organizer == null)
            throw new KeyNotFoundException("Организаторот не е пронајден.");

        var sport = await _unitOfWork.Sports.GetByIdAsync(request.SportId);
        if (sport == null)
            throw new KeyNotFoundException("Спортот не е пронајден.");

        SkillLevel? minSkillLevel = null;
        if (request.MinSkillLevel != null)
        {
            if (!Enum.TryParse<SkillLevel>(request.MinSkillLevel, true, out var parsed))
                throw new InvalidOperationException($"Invalid skill level: {request.MinSkillLevel}");
            minSkillLevel = parsed;
        }

        var sportEvent = new SportEvent
        {
            OrganizerId = request.OrganizerId,
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

        // Add confirmed participants
        var confirmedCount = 0;
        if (request.ConfirmedParticipantIds?.Any() == true)
        {
            foreach (var userId in request.ConfirmedParticipantIds.Distinct())
            {
                if (userId == request.OrganizerId) continue; // skip organizer

                var user = await _unitOfWork.Users.GetByIdAsync(userId);
                if (user == null) continue;

                var application = new EventApplication
                {
                    EventId = sportEvent.Id,
                    UserId = userId,
                    Status = ApplicationStatus.Approved,
                    AppliedAt = DateTime.UtcNow,
                    ResolvedAt = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _unitOfWork.EventApplications.AddAsync(application);
                confirmedCount++;
            }

            // Update status if full
            if (confirmedCount >= sportEvent.MaxParticipants)
                sportEvent.Status = EventStatus.Full;

            await _unitOfWork.SaveChangesAsync();
        }

        return new SportEventDto(
            Id: sportEvent.Id,
            OrganizerId: sportEvent.OrganizerId,
            OrganizerName: $"{organizer.FirstName} {organizer.LastName}",
            OrganizerPhotoUrl: organizer.ProfilePhotoUrl,
            OrganizerRating: organizer.AvgRatingAsOrganizer.HasValue ? (double)organizer.AvgRatingAsOrganizer.Value : null,
            SportId: sportEvent.SportId,
            SportName: sport.Name,
            SportIcon: sport.Icon,
            Title: sportEvent.Title,
            Description: sportEvent.Description,
            EventDate: sportEvent.EventDate,
            DurationMinutes: sportEvent.DurationMinutes,
            LocationAddress: sportEvent.LocationAddress,
            LocationLat: (double)sportEvent.LocationLat,
            LocationLng: (double)sportEvent.LocationLng,
            MaxParticipants: sportEvent.MaxParticipants,
            CurrentParticipants: confirmedCount,
            MinSkillLevel: sportEvent.MinSkillLevel?.ToString(),
            Status: sportEvent.Status.ToString(),
            AvgRating: null,
            CreatedAt: sportEvent.CreatedAt);
    }
}
