import * as bcrypt from 'bcrypt';
import * as express from 'express';
import * as jwt from 'jsonwebtoken';
import { getRepository } from 'typeorm';

import { UserWithThatEmailExistsException } from '../exceptions/UserWithThatEmailExistsException';
import { WrongCredentialsException } from '../exceptions/WrongCredentialsException';
import { Controller } from '../interfaces/controller.interface';
import { DataStoredInToken } from '../interfaces/dataStoredInToken.interface';
import { TokenData } from '../interfaces/tokenData.interface';
import { validationMiddleware } from '../middleware/validation.middleware';
import { CreateUserDto } from '../user/user.dto';
import { User } from '../user/user.entity';
import { LoginDto } from './login.dto';

export class AuthenticationController implements Controller {
  public path = '/auth';
  public router = express.Router();
  private userRepository = getRepository(User);

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      `${this.path}/register`,
      validationMiddleware(CreateUserDto),
      this.registration
    );
    this.router.post(
      `${this.path}/login`,
      validationMiddleware(LoginDto),
      this.loggingIn
    );
    this.router.post(`${this.path}/logout`, this.loggingOut);
  }

  private registration = async (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const userData: CreateUserDto = request.body;
    if (await this.userRepository.findOne({ email: userData.email })) {
      next(new UserWithThatEmailExistsException(userData.email));
    } else {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const user = this.userRepository.create({
        ...userData,
        password: hashedPassword
      });
      await this.userRepository.save(user);
      user.password = undefined;
      const tokenData = this.createToken(user);
      response.setHeader('Set-Cookie', [this.createCookie(tokenData)]);
      response.send(user);
    }
  };

  private loggingIn = async (
    request: express.Request,
    response: express.Response,
    next: express.NextFunction
  ) => {
    const loginData: LoginDto = request.body;
    const user = await this.userRepository.findOne({ email: loginData.email });
    if (user) {
      const passwordIsMatching = await bcrypt.compare(
        loginData.password,
        user.password
      );
      if (passwordIsMatching) {
        user.password = undefined;
        const tokenData = this.createToken(user);
        response.setHeader('Set-Cookie', [this.createCookie(tokenData)]);
        response.send(user);
      } else {
        next(new WrongCredentialsException());
      }
    } else {
      next(new WrongCredentialsException());
    }
  };

  private loggingOut = (
    request: express.Request,
    response: express.Response
  ) => {
    response.setHeader('Set-Cookie', ['Authorization=;Max-Age=0']);
    response.send(200);
  };

  private createCookie(tokenData: TokenData) {
    return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn}`;
  }

  private createToken(user: User): TokenData {
    const expiresIn = 60 * 60 * 24; // One Day
    const secret = process.env.JWT_SECRET;
    const dataStoredInToken: DataStoredInToken = {
      id: user.id
    };
    return {
      expiresIn,
      token: jwt.sign(dataStoredInToken, secret, { expiresIn })
    };
  }
}
