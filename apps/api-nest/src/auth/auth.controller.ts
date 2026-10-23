import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản người dùng mới' })
  @ApiResponse({ status: 201, description: 'Đăng ký thành công, trả về token' })
  async register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { email, username, password, fullName } = body;
    if (!email || !username) {
      throw new BadRequestException('Email và Username không được để trống');
    }

    const tokenData = await this.authService.register({ email, username, password, fullName });

    res.cookie('session_token', tokenData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600 * 1000,
    });

    return tokenData;
  }

  @Post('login')
  @ApiOperation({ summary: 'Đăng nhập bằng tài khoản và mật khẩu' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { username, email, password } = body;
    const identifier = email || username;

    if (!identifier || !password) {
      throw new UnauthorizedException('Username/email và mật khẩu là bắt buộc');
    }

    const user = await this.authService.validateUser(identifier, password);
    if (!user) {
      throw new UnauthorizedException('Thông tin đăng nhập không chính xác');
    }

    const tokenData = await this.authService.login(user);

    // Set secure cookie
    res.cookie('session_token', tokenData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600 * 1000,
    });

    return tokenData;
  }

  @Get('google/url')
  @ApiOperation({ summary: 'Lấy đường dẫn (URL) đăng nhập Google OAuth2' })
  getGoogleOAuthUrl() {
    return this.authService.getGoogleOAuthUrl();
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Xử lý Callback từ Google OAuth2 Redirect URI' })
  async googleOAuthCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      throw new BadRequestException('Thiếu mã xác thực (code) từ Google OAuth2');
    }

    const tokenData = await this.authService.handleGoogleCallback(code);

    res.cookie('session_token', tokenData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600 * 1000,
    });

    const frontendUrl = process.env.CORS_ORIGINS?.split(',')[0] || '/';
    return res.redirect(`${frontendUrl}?access_token=${encodeURIComponent(tokenData.accessToken)}`);
  }

  @Post('google')
  @ApiOperation({ summary: 'Đăng nhập hoặc đăng ký bằng tài khoản Google (OAuth2 ID Token)' })
  @ApiResponse({ status: 200, description: 'Xác thực Google thành công, trả về JWT session' })
  async googleAuth(@Body('idToken') idToken: string, @Res({ passthrough: true }) res: Response) {
    if (!idToken) {
      throw new BadRequestException('Google idToken là bắt buộc');
    }

    const tokenData = await this.authService.validateOrCreateGoogleUser(idToken);

    res.cookie('session_token', tokenData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600 * 1000,
    });

    return tokenData;
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin tài khoản đang đăng nhập' })
  getProfile(@Request() req: any) {
    return req.user;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất khỏi hệ thống' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('session_token');
    return { status: 'OK', message: 'Đăng xuất thành công' };
  }
}
