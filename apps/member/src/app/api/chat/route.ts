import { getAdapters } from '../../../adapters';
import { createChatHandler } from '../../../assistant/chat-handler';
import { getModel } from '../../../assistant/model';
import { getDb } from '../../../db/client';
import { getMemberFromCookies } from '../../../identity/session';

export async function POST(request: Request) {
  const handle = createChatHandler({
    db: getDb(),
    adapters: getAdapters(),
    getMember: () => getMemberFromCookies(),
    getModel: () => getModel(),
  });
  return handle(request);
}
