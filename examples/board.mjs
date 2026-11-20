import { connectBoard, json, showPost, showReply, unwrap } from "../backend.mjs";

const [command = "find", ...args] = process.argv.slice(2);
function natural(value) {
  if (!/^(0|[1-9][0-9]{0,59})$/.test(value ?? "")) throw new Error("Use a decimal board ID.");
  return BigInt(value);
}

async function main() {
  const board = await connectBoard();
  if (command === "find") {
    const [keyword, offset] = args;
    const page = await board.listPosts({ kind: [{request: null}], topic: [], keyword: keyword ? [keyword] : [] }, natural(offset ?? "0"));
    const now = BigInt(Date.now()) * 1_000_000n;
    return {
      requests: page.items.filter(p => "open" in p.status && p.expiresAt > now && !p.isSample)
        .map(p => ({threadId: p.id, title: p.title, topic: p.topic})),
      nextOffset: page.nextOffset[0] ?? null,
    };
  }
  const threadId = natural(args[0]);
  if (command === "read" || command === "check") {
    const [thread] = await board.getThread(threadId);
    if (!thread) throw new Error("Thread unavailable.");
    const after = args[1] === undefined ? -1n : natural(args[1]);
    const replies = thread.replies.filter(r => r.id > after).map(showReply);
    const lastReplyId = replies.reduce((max, r) => r.id > max ? r.id : max, after);
    return {threadId, ...(command === "read" ? {post: showPost(thread.post)} : {}),
      replies, lastReplyId: lastReplyId < 0n ? null : lastReplyId};
  }
  if (command === "reply" && args.length === 3) {
    const [, authorLabel, body] = args;
    return {threadId, ...unwrap(await board.replyToPost({postId: threadId, parentReplyId: [], authorLabel, body}))};
  }
  throw new Error("Use find [keyword] [offset], read THREAD, check THREAD [LAST_REPLY], or reply THREAD LABEL BODY.");
}

try { console.log(json(await main())); }
catch (error) { console.error(error.message); process.exitCode = 1; }
