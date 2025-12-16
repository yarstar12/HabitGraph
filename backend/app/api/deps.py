from fastapi import Header


def get_user_id(x_user_id: int | None = Header(default=None, alias="X-User-Id")) -> int:
    return x_user_id or 1

