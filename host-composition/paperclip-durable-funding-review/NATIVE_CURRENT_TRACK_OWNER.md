# Current-track blocker ownership

The native current-track branch now uses the same existing boardOwned-derived owner as the task-wide branch. Status remains blocked; there is no self-wake or automatic retry. Board-owned decisions, private attention, governance, tool approval, dependency, pause and recovery guards remain unchanged. Existing historical descriptors are not rewritten.

Exact runtime delta: status-arbiter.js changes two board owner literals to the already-computed owner. The new additive overlay pins the previous bytes and all current guards. Historical overlays remain immutable. Composed qualification is 41 files and 16 explicit supersessions.

Actual offline PostgreSQL test derives an agent-owned descriptor from the real arbiter and passes it through actual Coordinator continuation/native queue, lost-ack/cold replay and 19 existing denial cases plus nested/FK races. It separately asserts boardOwned, human/private attention and governance preservation. The unchanged baseline fails the owner assertion; corrected candidate passes. Provider execution is not claimed.
