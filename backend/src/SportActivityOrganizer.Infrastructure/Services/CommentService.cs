using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SportActivityOrganizer.Application.DTOs.Comments;
using SportActivityOrganizer.Application.Interfaces;
using SportActivityOrganizer.Application.Interfaces.Persistence;
using SportActivityOrganizer.Domain.Entities;
using SportActivityOrganizer.Domain.Enums;

namespace SportActivityOrganizer.Infrastructure.Services;

public class CommentService : ICommentService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly INotificationService _notificationService;

    public CommentService(IUnitOfWork unitOfWork, IMapper mapper, INotificationService notificationService)
    {
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _notificationService = notificationService;
    }

    public async Task<List<EventCommentDto>> GetEventCommentsAsync(int userId, int eventId, bool isAdmin)
    {
        var sportEvent = await _unitOfWork.SportEvents.Query()
            .Include(e => e.Applications)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (sportEvent == null)
            throw new KeyNotFoundException("Event not found.");

        // FR-6.5: only the organizer, approved participants (and admins) may
        // read the event's comments. Users still awaiting approval must not.
        var isOrganizer = sportEvent.OrganizerId == userId;
        var isParticipant = sportEvent.Applications
            .Any(a => a.UserId == userId && a.Status == ApplicationStatus.Approved);

        if (!isAdmin && !isOrganizer && !isParticipant)
            throw new UnauthorizedAccessException("Only the organizer or approved participants can view comments.");

        var comments = await _unitOfWork.EventComments.Query()
            .Include(c => c.User)
            .Where(c => c.EventId == eventId && !c.IsDeleted)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return _mapper.Map<List<EventCommentDto>>(comments);
    }

    public async Task<EventCommentDto> CreateAsync(int userId, int eventId, CreateCommentRequest request)
    {
        var sportEvent = await _unitOfWork.SportEvents.Query()
            .Include(e => e.Applications)
            .FirstOrDefaultAsync(e => e.Id == eventId);

        if (sportEvent == null)
            throw new KeyNotFoundException("Event not found.");

        // Only organizer or approved participants can create comments
        var isOrganizer = sportEvent.OrganizerId == userId;
        var isParticipant = sportEvent.Applications
            .Any(a => a.UserId == userId && a.Status == ApplicationStatus.Approved);

        if (!isOrganizer && !isParticipant)
            throw new UnauthorizedAccessException("Only the organizer or approved participants can create comments.");

        var user = await _unitOfWork.Users.GetByIdAsync(userId);
        if (user == null)
            throw new KeyNotFoundException("User not found.");

        var comment = new EventComment
        {
            EventId = eventId,
            UserId = userId,
            Content = request.Content,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.EventComments.AddAsync(comment);
        await _unitOfWork.SaveChangesAsync();

        // Notify ALL approved participants and organizer about the new comment (except the commenter)
        var recipientIds = sportEvent.Applications
            .Where(a => a.Status == ApplicationStatus.Approved && a.UserId != userId)
            .Select(a => a.UserId)
            .ToList();

        // Also notify organizer if not the commenter
        if (!isOrganizer && !recipientIds.Contains(sportEvent.OrganizerId))
            recipientIds.Add(sportEvent.OrganizerId);

        foreach (var recipientId in recipientIds)
        {
            await _notificationService.CreateNotificationAsync(
                recipientId,
                NotificationType.NewComment,
                "Нов коментар",
                $"{user.FirstName} {user.LastName} коментираше на \"{sportEvent.Title}\".",
                eventId);
        }

        return new EventCommentDto(
            Id: comment.Id,
            EventId: comment.EventId,
            UserId: comment.UserId,
            UserName: $"{user.FirstName} {user.LastName}",
            UserPhotoUrl: user.ProfilePhotoUrl,
            Content: comment.Content,
            CreatedAt: comment.CreatedAt);
    }

    public async Task DeleteAsync(int userId, int commentId, bool isAdmin)
    {
        var comment = await _unitOfWork.EventComments.Query()
            .Include(c => c.Event)
            .FirstOrDefaultAsync(c => c.Id == commentId);

        if (comment == null)
            throw new KeyNotFoundException("Comment not found.");

        // Comment author, event organizer, or admin can delete comments
        var isAuthor = comment.UserId == userId;
        var isOrganizer = comment.Event.OrganizerId == userId;

        if (!isAuthor && !isOrganizer && !isAdmin)
            throw new UnauthorizedAccessException("Only the comment author, organizer, or admin can delete comments.");

        comment.IsDeleted = true;
        await _unitOfWork.SaveChangesAsync();
    }
}
