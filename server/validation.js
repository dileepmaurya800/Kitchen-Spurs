const ID = /^[a-zA-Z0-9_-]{8,100}$/;
export function validId(value) {
  return typeof value === 'string' && ID.test(value);
}
export function validateEvents(body, source, now = Date.now()) {
  if (!body || !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 50)
    throw new Error('Provide between 1 and 50 events');
  return body.events.map((e) => {
    if (
      !e ||
      !validId(e.id) ||
      !validId(e.visitorId) ||
      (e.sessionId != null && !validId(e.sessionId))
    )
      throw new Error('Invalid event or identity ID');
    if (typeof e.name !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(e.name))
      throw new Error('Invalid event name');
    if (source === 'browser' && e.name === 'order_created')
      throw new Error('order_created is a server-only event');
    if (
      typeof e.occurredAt !== 'string' ||
      !Number.isFinite(Date.parse(e.occurredAt)) ||
      Date.parse(e.occurredAt) < now - 7 * 86400000 ||
      Date.parse(e.occurredAt) > now + 300000
    )
      throw new Error('Event time must be within the last 7 days and no more than 5 minutes ahead');
    if (
      e.path != null &&
      (typeof e.path !== 'string' ||
        !e.path.startsWith('/') ||
        e.path.length > 300 ||
        /[?#\r\n]/.test(e.path))
    )
      throw new Error('Path must be a pathname without query or fragment');
    if (e.name === 'page_view' && !e.path) throw new Error('page_view requires path');
    const properties = e.properties ?? {};
    if (
      typeof properties !== 'object' ||
      Array.isArray(properties) ||
      JSON.stringify(properties).length > 4096
    )
      throw new Error('Properties must be an object of at most 4KB');
    if (
      source === 'server' &&
      e.name === 'order_created' &&
      (!Number.isSafeInteger(properties.total) ||
        properties.total < 0 ||
        properties.currency !== 'INR')
    )
      throw new Error('Order total must be a nonnegative INR integer');
    return {
      id: e.id,
      name: e.name,
      visitorId: e.visitorId,
      sessionId: e.sessionId,
      path: e.path,
      occurredAt: new Date(e.occurredAt).toISOString(),
      properties,
    };
  });
}
