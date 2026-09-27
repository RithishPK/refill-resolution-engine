"""In-memory store. Deliberately dependency-free so it runs on any Python.

This is the ONLY place data lives. Everything goes through this thin interface,
so swapping in Postgres/SQLAlchemy later is a single-file change - the repository
seam is right here.
"""
from threading import Lock
from .models import Case, Event


class Store:
    def __init__(self):
        self._cases: dict[int, Case] = {}
        self._events: list[Event] = []
        self._cid = 0
        self._eid = 0
        self._lock = Lock()

    def add_case(self, case: Case) -> Case:
        with self._lock:
            self._cid += 1
            case.id = self._cid
            self._cases[case.id] = case
        return case

    def get_case(self, cid: int) -> Case | None:
        return self._cases.get(cid)

    def list_cases(self, state: str | None = None) -> list[Case]:
        cs = list(self._cases.values())
        return [c for c in cs if c.state == state] if state else cs

    def add_event(self, ev: Event) -> Event:
        with self._lock:
            self._eid += 1
            ev.id = self._eid
            self._events.append(ev)
        return ev

    def events_for(self, cid: int) -> list[Event]:
        return [e for e in self._events if e.case_id == cid]

    def reset(self):
        with self._lock:
            self._cases.clear()
            self._events.clear()
            self._cid = 0
            self._eid = 0


store = Store()
