import { SetMetadata } from '@nestjs/common';

export const PERMS_KEY = 'required_perms';

/** Require one or more functional permissions, e.g. @Perms('pim.write'). */
export const Perms = (...perms: string[]) => SetMetadata(PERMS_KEY, perms);
