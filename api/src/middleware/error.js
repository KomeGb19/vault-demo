export const notFound = (req, res) =>
  res
    .status(404)
    .json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

export const errorHandler = (err, req, res, next) => {
  const status =
    err.status ||
    (["ValidationError", "CastError"].includes(err.name) ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || "Server error" });
};
