namespace SportActivityOrganizer.Application.DTOs.Auth;

// FR-1.6: registration does NOT log the user in. They must confirm their
// email before they can log in, so no tokens are returned here.
public record RegisterResponse(
    string Email,
    string Message);
