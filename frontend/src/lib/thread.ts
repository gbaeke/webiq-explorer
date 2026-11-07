// The assistant's conversation lives on the server under this id. sessionStorage: a reload continues the
// conversation, a new tab starts a fresh one.
const KEY = 'webiq-assistant-thread'

export function newThreadId(): string {
  const id = crypto.randomUUID()
  try {
    sessionStorage.setItem(KEY, id)
  } catch {
    // storage blocked (private mode): the id lasts until reload
  }
  return id
}

export function currentThreadId(): string {
  try {
    return sessionStorage.getItem(KEY) ?? newThreadId()
  } catch {
    return newThreadId()
  }
}
