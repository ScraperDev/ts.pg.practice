import { HttpException } from './HttpException';

export class WrongCredentialsException extends HttpException {
  constructor() {
    super(401, 'Wrong Credentials Provided');
  }
}
