import json

import pika

from app.core.settings import settings

_connection: pika.BlockingConnection | None = None
_channel: pika.adapters.blocking_connection.BlockingChannel | None = None


def _get_channel():
    global _connection, _channel
    amqp_url = settings.rabbitmq_amqp_url()
    if not amqp_url:
        return None
    if _channel and _channel.is_open:
        return _channel

    params = pika.URLParameters(amqp_url)
    _connection = pika.BlockingConnection(params)
    _channel = _connection.channel()
    _channel.exchange_declare(exchange="habitgraph.events", exchange_type="topic", durable=True)
    return _channel


def publish_event(routing_key: str, payload: dict) -> None:
    ch = _get_channel()
    if ch is None:
        return
    ch.basic_publish(
        exchange="habitgraph.events",
        routing_key=routing_key,
        body=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        properties=pika.BasicProperties(content_type="application/json", delivery_mode=2),
    )
