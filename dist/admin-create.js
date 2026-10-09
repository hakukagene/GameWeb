// Create a recoverable draft first; publish only after selected uploads succeed.
export async function createGameWithFiles({payload, coverFile, buildFile, buildVersion, api, upload, onCreated}) {
  for (const [file, limit, label] of [[coverFile, 5, 'Зураг'], [buildFile, 512, 'ZIP']]) {
    if (file?.size > limit * 1024 * 1024) throw Error(`${label} ${limit} MB-аас бага байна.`);
  }
  const {game: draft} = await api('/admin/games', {...payload, published: false});
  onCreated(draft);
  let game = draft;
  try {
    if (coverFile?.size) ({game} = await upload(`/admin/games/${game.id}/cover`, coverFile, coverFile.type));
    if (buildFile?.size) ({game} = await upload(`/admin/games/${game.id}/builds?version=${encodeURIComponent(buildVersion.trim())}`, buildFile, 'application/zip'));
    if (payload.published) {
      const {id, ...metadata} = payload;
      ({game} = await api(`/admin/games/${game.id}`, {...metadata, version: game.length, revision: game.revision}));
    }
    return game;
  } catch (cause) {
    const error = Error(`Тоглоом үүссэн. Дахин үүсгэх шаардлагагүй. ${cause.message} Оруулаагүй файлаа доорх хэсгээс дахин сонгож оруулна уу.`, {cause});
    error.createdGameId = draft.id;
    throw error;
  }
}
