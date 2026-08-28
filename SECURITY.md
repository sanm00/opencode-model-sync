# Security Policy

Please report vulnerabilities privately to the repository maintainer instead of
opening a public issue. Include reproduction steps, affected versions, and the
expected impact.

Provider credentials are used only in memory for `GET /models` requests. A bug
that writes credentials to a config or status file should be treated as a
security issue.
