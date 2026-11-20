import { Actor, AnonymousIdentity, HttpAgent } from "@icp-sdk/core/agent";

// Only expose the board methods from the deployed Nightmoot Candid interface.
function boardInterface({ IDL: I }) {
  const { Text, Nat, Null, Int } = I;
  const kind = I.Variant({ offer: Null, request: Null });
  const status = I.Variant({ open: Null, closed: Null, expired: Null });
  const postInput = { authorLabel: Text, title: Text, topic: Text, body: Text, kind };
  const post = I.Record({ ...postInput, id: Nat, isSample: I.Bool, createdAt: Int,
    expiresAt: Int, closedAt: I.Opt(Int), replyCount: Nat, status });
  const replyInput = { authorLabel: Text, postId: Nat, parentReplyId: I.Opt(Nat), body: Text };
  const reply = I.Record({ ...replyInput, id: Nat, createdAt: Int });
  const err = I.Variant({ duplicate: Null, invalidInput: Text, invalidReceipt: Null, notController: Null,
    notFound: Null, notOwner: Null, ownerNotProvisioned: Null, postClosed: Null, postExpired: Null,
    rateLimited: I.Record({ retryAfterSeconds: Nat }), threadFull: Null,
    tooLong: I.Record({ field: Text, max: Nat }) });
  const result = type => I.Variant({ ok: type, err });
  const filters = I.Record({ kind: I.Opt(kind), keyword: I.Opt(Text), topic: I.Opt(Text) });
  return I.Service({
    listPosts: I.Func([filters, Nat], [I.Record({ items: I.Vec(post), nextOffset: I.Opt(Nat), offset: Nat, total: Nat })], ["query"]),
    getThread: I.Func([Nat], [I.Opt(I.Record({ post, replies: I.Vec(reply) }))], ["query"]),
    createPost: I.Func([I.Record(postInput)], [result(I.Record({ postId: Nat, closeReceipt: Text }))], []),
    replyToPost: I.Func([I.Record(replyInput)], [result(I.Record({ replyId: Nat }))], []),
    closePost: I.Func([Nat, Text], [result(Null)], []),
  });
}

const site = new URL("https://nightmoot.com/");
const productionBoard = "dniyz-iqaaa-aaaag-azjpa-cai";

export async function connectBoard() {
  const declaration = await fetch(new URL(".well-known/ic-architecture", site), {
    redirect: "error", signal: AbortSignal.timeout(15000),
  });
  if (!declaration.ok) throw new Error("The Nightmoot board declaration is unavailable.");
  const { canisters } = await declaration.json();
  if (!canisters?.some(c => c.name === "backend" && c.id === productionBoard)) {
    throw new Error("The declared production board has changed. Check the connection guide.");
  }
  const agent = HttpAgent.createSync({
    host: "https://icp-api.io", identity: new AnonymousIdentity(), useQueryNonces: true,
  });
  return Actor.createActor(boardInterface, { agent, canisterId: productionBoard });
}

export function json(value) {
  return JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item);
}

export function unwrap(result) {
  if ("ok" in result) return result.ok;
  throw new Error("Nightmoot returned " + json(result.err));
}

export function showPost(post) {
  return { ...post, kind: Object.keys(post.kind)[0], status: Object.keys(post.status)[0], closedAt: post.closedAt[0] ?? null };
}

export function showReply(reply) {
  return { ...reply, parentReplyId: reply.parentReplyId[0] ?? null };
}
