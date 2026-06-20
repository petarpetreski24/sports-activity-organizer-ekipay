using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SportActivityOrganizer.Application.DTOs.Comments;
using SportActivityOrganizer.Application.Interfaces;

namespace SportActivityOrganizer.API.Controllers;

[ApiController]
[Route("api/events/{eventId}/comments")]
[Authorize]
public class EventCommentsController : ControllerBase
{
    private readonly ICommentService _commentService;

    public EventCommentsController(ICommentService commentService)
    {
        _commentService = commentService;
    }

    private int GetUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsAdmin() => User.IsInRole("Admin");

    [HttpGet]
    public async Task<ActionResult<List<EventCommentDto>>> GetComments(int eventId)
    {
        var result = await _commentService.GetEventCommentsAsync(GetUserId(), eventId, IsAdmin());
        return Ok(result);
    }

    [HttpPost]
    public async Task<ActionResult<EventCommentDto>> Create(int eventId, [FromBody] CreateCommentRequest request)
    {
        var result = await _commentService.CreateAsync(GetUserId(), eventId, request);
        return Ok(result);
    }

    [HttpDelete("{commentId}")]
    public async Task<IActionResult> Delete(int eventId, int commentId)
    {
        await _commentService.DeleteAsync(GetUserId(), commentId, IsAdmin());
        return Ok(new { message = "Коментарот е избришан." });
    }
}
