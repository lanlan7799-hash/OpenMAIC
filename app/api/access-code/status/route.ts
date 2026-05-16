import { cookies } from 'next/headers';
import { apiSuccess } from '@/lib/server/api-response';
import { verifyAccessToken } from '@/app/api/access-code/verify/route';
import {
  FAMILYBUDDY_LAUNCH_COOKIE,
  resolveFamilyBuddyLaunchSecret,
  verifyFamilyBuddyLaunchToken,
} from '@/lib/server/familybuddy-launch-token';

export async function GET() {
  const accessCode = process.env.ACCESS_CODE;
  const enabled = !!accessCode;

  let authenticated = false;
  if (enabled) {
    const cookieStore = await cookies();
    const token = cookieStore.get('openmaic_access')?.value;
    authenticated = !!token && verifyAccessToken(token, accessCode);
    if (!authenticated) {
      const launchToken = cookieStore.get(FAMILYBUDDY_LAUNCH_COOKIE)?.value;
      authenticated =
        (
          await verifyFamilyBuddyLaunchToken(
            launchToken,
            resolveFamilyBuddyLaunchSecret(accessCode),
          )
        ).ok;
    }
  }

  return apiSuccess({ enabled, authenticated });
}
