import { getAdapters } from '../../../adapters';
import { createChatHandler } from '../../../assistant/chat-handler';
import { getModel } from '../../../assistant/model';
import { getDb } from '../../../db/client';
import { effectiveEnv } from '../../../settings/store';
import { getMemberFromCookies } from '../../../identity/session';

export async function POST(request: Request) {
  const env = await effectiveEnv(getDb());
  const handle = createChatHandler({
    db: getDb(),
    adapters: getAdapters(),
    getMember: () => getMemberFromCookies(),
    getModel: () => getModel(env),
  });
  return handle(request);
}
