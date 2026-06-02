import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

/**
 * Logs every mutating request (POST/PUT/PATCH/DELETE). The "after" snapshot is
 * the handler result; entity/action are inferred from route + method.
 * Read-path masking and "before" capture happen in the services.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const method: string = req.method;
    if (['GET', 'OPTIONS', 'HEAD'].includes(method)) return next.handle();

    const action =
      method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';
    const entity = (req.baseUrl + req.path).split('/').filter(Boolean)[1] ?? 'unknown';

    return next.handle().pipe(
      tap((result) =>
        void this.audit.record({
          userId: req.user?.sub,
          activePostId: req.user?.activePost,
          action,
          entity,
          entityId: (result as any)?.id,
          after: result,
          ip: req.ip,
        }),
      ),
    );
  }
}
