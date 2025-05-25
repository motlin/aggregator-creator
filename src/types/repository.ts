import {z} from 'zod'

export const repositorySchema = z.object({
  name: z.string(),
  owner: z.object({
    login: z.string(),
    type: z.string(),
  }),
  language: z.string().nullable(),
  topics: z.array(z.string()).optional(),
  fork: z.boolean(),
  archived: z.boolean(),
  disabled: z.boolean(),
  is_template: z.boolean(),
  private: z.boolean(),
  visibility: z.string(),
})

export const repositoriesSchema = z.array(repositorySchema)

export type Repository = z.infer<typeof repositorySchema>
export type Repositories = z.infer<typeof repositoriesSchema>

export const validatedRepositorySchema = repositorySchema.extend({
  path: z.string(),
  hasPom: z.boolean(),
  valid: z.boolean(),
})

export const validatedRepositoriesSchema = z.array(validatedRepositorySchema)

export type ValidatedRepository = z.infer<typeof validatedRepositorySchema>
export type ValidatedRepositories = z.infer<typeof validatedRepositoriesSchema>
