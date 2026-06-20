using AutoMapper;
using Microsoft.EntityFrameworkCore;
using SportActivityOrganizer.Application.DTOs.Auth;
using SportActivityOrganizer.Application.DTOs.Users;
using SportActivityOrganizer.Application.Interfaces;
using SportActivityOrganizer.Application.Interfaces.Persistence;
using SportActivityOrganizer.Domain.Entities;
using SportActivityOrganizer.Domain.Enums;

namespace SportActivityOrganizer.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ITokenService _tokenService;
    private readonly IEmailService _emailService;
    private readonly IMapper _mapper;

    public AuthService(IUnitOfWork unitOfWork, ITokenService tokenService, IEmailService emailService, IMapper mapper)
    {
        _unitOfWork = unitOfWork;
        _tokenService = tokenService;
        _emailService = emailService;
        _mapper = mapper;
    }

    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request)
    {
        // FR-1.5: Password validation — min 8 chars, at least one uppercase, at least one digit
        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
            throw new ArgumentException("Лозинката мора да содржи најмалку 8 карактери.");
        if (!request.Password.Any(char.IsUpper))
            throw new ArgumentException("Лозинката мора да содржи најмалку една голема буква.");
        if (!request.Password.Any(char.IsDigit))
            throw new ArgumentException("Лозинката мора да содржи најмалку една цифра.");

        var existingUser = await _unitOfWork.Users
            .AnyAsync(u => u.Email.ToLower() == request.Email.ToLower());

        if (existingUser)
            throw new InvalidOperationException("A user with this email already exists.");

        var emailConfirmationToken = Guid.NewGuid().ToString();

        var user = new User
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email.ToLower(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = UserRole.User,
            IsActive = true,
            EmailConfirmed = false,
            EmailConfirmationToken = emailConfirmationToken,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Users.AddAsync(user);
        await _unitOfWork.SaveChangesAsync();

        // Create default notification preferences
        var notificationPreference = new NotificationPreference
        {
            UserId = user.Id,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _unitOfWork.NotificationPreferences.AddAsync(notificationPreference);
        await _unitOfWork.SaveChangesAsync();

        // Send confirmation email
        await _emailService.SendEmailConfirmationAsync(user.Email, emailConfirmationToken);

        // FR-1.6: the user must confirm their email before they can log in,
        // so registration does NOT issue authentication tokens.
        return new RegisterResponse(
            Email: user.Email,
            Message: "Регистрацијата е успешна. Проверете го вашиот email за да ја потврдите адресата пред да се најавите.");
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        var user = await _unitOfWork.Users.Query()
            .Include(u => u.FavoriteSports)
                .ThenInclude(fs => fs.Sport)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        if (user == null)
            throw new UnauthorizedAccessException("Invalid email or password.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("This account has been deactivated.");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid email or password.");

        if (!user.EmailConfirmed)
            throw new InvalidOperationException("Ве молиме потврдете ја вашата е-пошта пред да се најавите. Проверете го вашето сандаче.");

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        return new AuthResponse(
            AccessToken: accessToken,
            RefreshToken: refreshToken,
            User: _mapper.Map<UserDto>(user));
    }

    public async Task<AuthResponse> RefreshTokenAsync(RefreshTokenRequest request)
    {
        var user = await _unitOfWork.Users.Query()
            .Include(u => u.FavoriteSports)
                .ThenInclude(fs => fs.Sport)
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);

        if (user == null)
            throw new UnauthorizedAccessException("Invalid refresh token.");

        if (user.RefreshTokenExpiry < DateTime.UtcNow)
            throw new UnauthorizedAccessException("Refresh token has expired.");

        if (!user.IsActive)
            throw new UnauthorizedAccessException("This account has been deactivated.");

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiry = DateTime.UtcNow.AddDays(7);
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        return new AuthResponse(
            AccessToken: accessToken,
            RefreshToken: refreshToken,
            User: _mapper.Map<UserDto>(user));
    }

    public async Task ConfirmEmailAsync(string token)
    {
        var user = await _unitOfWork.Users.Query()
            .FirstOrDefaultAsync(u => u.EmailConfirmationToken == token);

        if (user == null)
            throw new KeyNotFoundException("Invalid confirmation token.");

        user.EmailConfirmed = true;
        user.EmailConfirmationToken = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        var user = await _unitOfWork.Users.Query()
            .FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());

        // Don't reveal if the user exists or not
        if (user == null)
            return;

        var resetToken = Guid.NewGuid().ToString();
        user.PasswordResetToken = resetToken;
        user.PasswordResetTokenExpiry = DateTime.UtcNow.AddHours(1);
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();

        await _emailService.SendPasswordResetAsync(user.Email, resetToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        var user = await _unitOfWork.Users.Query()
            .FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token);

        if (user == null)
            throw new KeyNotFoundException("Invalid reset token.");

        if (user.PasswordResetTokenExpiry < DateTime.UtcNow)
            throw new InvalidOperationException("Reset token has expired.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;
        user.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync();
    }
}
