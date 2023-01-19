import { z } from './dependencies.ts'
import type { Nominal } from './util.ts'
import type { BuiltSchemaField, SchemaFieldGeneric, SchemaParams, SchemaResult } from './schema.ts'
import type { ZodInput } from './util.ts'



export type ColumnInput =
  | SchemaFieldGeneric
  | SchemaFieldGeneric[]
