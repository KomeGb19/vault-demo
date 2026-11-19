import jwt from "jsonwebtoken";
import Council from "../models/Council.js";

export const signMemberToken = (councilId, memberId) =>
  jwt.sign(
    { typ: "member", councilId: String(councilId), memberId: String(memberId) },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );

function readToken(req) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return { error: "Missing token" };
  try {
    return { payload: jwt.verify(token, process.env.JWT_SECRET) };
  } catch {
    return { error: "Invalid or expired token" };
  }
}

// Approve / reject: council member tokens only
export async function requireMember(req, res, next) {
  try {
    const { payload, error } = readToken(req);
    if (error) return res.status(401).json({ error });
    if (payload.typ !== "member") {
      return res
        .status(403)
        .json({ error: "Only council members can approve or reject" });
    }
    const council = await Council.findById(payload.councilId);
    const member = council?.members.id(payload.memberId);
    if (!member)
      return res.status(403).json({ error: "Not a member of this council" });
    req.council = council;
    req.member = member;
    next();
  } catch (e) {
    next(e);
  }
}

// Audit: the council owner (user token) or any council member (member token)
export async function requireCouncilAccess(req, res, next) {
  try {
    const { payload, error } = readToken(req);
    if (error) return res.status(401).json({ error });
    let council;
    if (payload.typ === "member") {
      council = await Council.findById(payload.councilId);
      if (!council?.members.id(payload.memberId)) {
        return res.status(403).json({ error: "Not a member of this council" });
      }
    } else {
      council = await Council.findOne({ ownerId: payload.sub });
      if (!council)
        return res.status(403).json({ error: "No council for this user" });
    }
    req.councilId = council.id;
    next();
  } catch (e) {
    next(e);
  }
}
