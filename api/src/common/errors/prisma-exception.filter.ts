import { type ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';
import { Errors } from './app-error.js';

/**
 * DB(Prisma) 오류를 화면이 분기할 수 있는 응답으로 바꾼다. 나머지는 Nest 기본 처리.
 * - P2002 중복(동시에 두 번 누름 등) → 409 CONFLICT
 * - P2025 대상 없음 → 404 NOT_FOUND
 * - 형식이 틀린 값(uuid 아님 · 너무 긴 값 · 잘못된 날짜) → 400 BAD_INPUT
 * - 동시 처리 충돌(P2034) → 409 CONFLICT
 */
export function mapPrismaError(err: unknown): HttpException | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
      case 'P2034':
        return Errors.conflict();
      case 'P2025':
        return Errors.notFound('항목');
      case 'P2000':
      case 'P2003':
      case 'P2006':
      case 'P2007':
      case 'P2011':
      case 'P2012':
      case 'P2019':
      case 'P2020':
        return Errors.badInput();
      default:
        return null;
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) return Errors.badInput();
  return null;
}

const HANGUL = /\p{Script=Hangul}/u;

/**
 * errorCode 없이 나가는 400 (깨진 JSON · ParseUUIDPipe 같은 Nest 기본 오류)은 영어 문구 대신 한국어로.
 * 이미 한국어 메시지면 그대로 두고 errorCode 만 붙인다.
 */
export function koreanizeBadRequest(err: unknown): HttpException | null {
  if (!(err instanceof HttpException) || err.getStatus() !== 400) return null;
  const body = err.getResponse();
  if (typeof body === 'object' && body !== null && 'errorCode' in body) return null;
  const raw = typeof body === 'string' ? body : (body as { message?: unknown }).message;
  const first: unknown = Array.isArray(raw) ? raw[0] : raw;
  const message = typeof first === 'string' ? first : '';
  if (/JSON/i.test(message) || (err.cause as { type?: string } | undefined)?.type === 'entity.parse.failed')
    return Errors.badJson();
  if (HANGUL.test(message)) return Errors.validation(message);
  return Errors.badInput();
}

@Catch()
export class AppExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const bad = koreanizeBadRequest(exception);
    if (bad) return super.catch(bad, host);
    const mapped = mapPrismaError(exception);
    if (mapped) {
      this.logger.warn(`DB 오류 → ${mapped.getStatus()}: ${(exception as Error).message.split('\n').at(-1)}`);
      return super.catch(mapped, host);
    }
    return super.catch(exception, host);
  }
}
