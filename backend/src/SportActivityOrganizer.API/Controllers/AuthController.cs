using Microsoft.AspNetCore.Mvc;
using SportActivityOrganizer.Application.DTOs.Auth;
using SportActivityOrganizer.Application.Interfaces;

namespace SportActivityOrganizer.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<ActionResult<RegisterResponse>> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);
        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        return Ok(result);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var result = await _authService.RefreshTokenAsync(request);
        return Ok(result);
    }

    [HttpGet("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromQuery] string token)
    {
        try
        {
            await _authService.ConfirmEmailAsync(token);
            // Redirect to frontend login with success message
            var frontendUrl = Environment.GetEnvironmentVariable("APP_FRONTEND_URL") ?? "http://localhost:5173";
            return Redirect($"{frontendUrl}/login?emailConfirmed=true");
        }
        catch (Exception)
        {
            var frontendUrl = Environment.GetEnvironmentVariable("APP_FRONTEND_URL") ?? "http://localhost:5173";
            return Redirect($"{frontendUrl}/login?emailConfirmed=false");
        }
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        await _authService.ForgotPasswordAsync(request);
        return Ok(new { message = "Доколку email адресата постои, ќе добиете линк за ресетирање на лозинката." });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        await _authService.ResetPasswordAsync(request);
        return Ok(new { message = "Лозинката е успешно променета." });
    }
}
