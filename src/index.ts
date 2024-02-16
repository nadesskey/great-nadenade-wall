export interface Env {
  KV: KVNamespace;
}

const hasBadWords = (text: string, badWords: string[]) => {
  // 対策用の区切り文字などを削除して判定する
  const normalizedText = text.replace(/[ /　／]/g, '');
  return badWords.length > 0 && badWords.some(word => normalizedText.includes(word));
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const badWords = (await env.KV.get('badWords') ?? '').split(';').filter(w => w != '');

    // HEADやGETの場合はそのまま返す
    if (request.method === 'HEAD' || request.method === 'GET') {
      return await fetch(request.url, {
        method: request.method,
        headers: request.headers,
      });
    }
    const body = await request.text();

    // NGワードを含む場合はエラーで弾く
    if (hasBadWords(body, badWords)) {
      const message = (await env.KV.get('errorMessage') ?? 'その投稿には不適切な単語が含まれています。')
      return new Response(JSON.stringify({
        error: {
          message: message,
          code: 'BAD_WORDS',
          id: 'c1d9e31a-85ee-45b9-9456-7c749fc4f475',
        }
      }), {
        // Note: ActivityPubで400を返してしまうとリモートからのretryが相次いだり、最悪配送停止されてしまったりするので、inboxでは202を返す
        status: request.url.includes('inbox') ? 202 : 400,
      });
    }

    return await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body,
    });
  },
};