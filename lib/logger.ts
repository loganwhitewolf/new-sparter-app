import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'
import { headers } from 'next/headers'
import pino from 'pino'
import { auth } from '@/auth'

export const DEFAULT_BETTERSTACK_ENDPOINT = 'https://in.logs.betterstack.com'
const REDACTED = '[Redacted]'

type LoggerEnv = Partial<
  Pick<NodeJS.ProcessEnv, 'BETTERSTACK_INGESTING_URL' | 'BETTERSTACK_SOURCE_TOKEN' | 'LOG_LEVEL' | 'NODE_ENV'>
>

export type LogContext = {
  userId?: string
} & Record<string, string | number | boolean | undefined>

const logContextStorage = new AsyncLocalStorage<LogContext>()

function redactLogValue(value: unknown) {
  if (typeof value !== 'string') {
    return REDACTED
  }

  const queryIndex = value.indexOf('?')

  if (queryIndex > -1) {
    return `${value.slice(0, queryIndex)}?${REDACTED}`
  }

  return REDACTED
}

export function getLogContext() {
  return logContextStorage.getStore() ?? {}
}

export function withLogContext<T>(context: LogContext, callback: () => T): T {
  const parentContext = getLogContext()

  return logContextStorage.run({ ...parentContext, ...context }, callback)
}

export async function withUserId<T>(
  callback: () => T | Promise<T>,
  extraContext: LogContext = {},
): Promise<T> {
  let context = extraContext

  try {
    const requestHeaders = await headers()

    if (
      process.env.STAGING_KEY &&
      requestHeaders.get('x-staging-key') === process.env.STAGING_KEY
    ) {
      context = {
        ...extraContext,
        userId: process.env.STAGING_USER_ID ?? 'staging-user',
      }
    } else {
      const session = await auth.api.getSession({
        headers: requestHeaders,
      })

      if (session?.user?.id) {
        context = {
          ...extraContext,
          userId: session.user.id,
        }
      }
    }
  } catch {
    context = extraContext
  }

  return withLogContext(context, callback)
}

export function buildTransportConfig(env: LoggerEnv = process.env): pino.LoggerOptions['transport'] {
  const sourceToken = env.BETTERSTACK_SOURCE_TOKEN?.trim()

  if (sourceToken) {
    return {
      targets: [
        {
          target: '@logtail/pino',
          options: {
            sourceToken,
            options: {
              endpoint: env.BETTERSTACK_INGESTING_URL?.trim() || DEFAULT_BETTERSTACK_ENDPOINT,
            },
          },
        },
        {
          target: 'pino/file',
          options: {
            destination: 1,
          },
        },
      ],
    }
  }

  if (env.NODE_ENV === 'development') {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  }

  return undefined
}

export function createLoggerOptions(env: LoggerEnv = process.env): pino.LoggerOptions {
  return {
    level: env.LOG_LEVEL?.trim() || (env.NODE_ENV === 'development' ? 'debug' : 'info'),
    transport: buildTransportConfig(env),
    redact: {
      paths: [
        'token',
        '*.token',
        'sourceToken',
        '*.sourceToken',
        'BETTERSTACK_SOURCE_TOKEN',
        '*.BETTERSTACK_SOURCE_TOKEN',
        'authorization',
        '*.authorization',
        'headers.authorization',
        'url',
        '*.url',
        'uploadUrl',
        '*.uploadUrl',
        'presignedUrl',
        '*.presignedUrl',
      ],
      censor: redactLogValue,
    },
    mixin() {
      return getLogContext()
    },
  }
}

export const logger = pino(createLoggerOptions())

export default logger
