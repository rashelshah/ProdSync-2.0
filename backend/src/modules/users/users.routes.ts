import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth.middleware'
import { asyncHandler } from '../../utils/asyncHandler'
import { adminClient } from '../../config/supabaseClient'

export const usersRouter = Router()

usersRouter.get(
  '/profile',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { data, error } = await adminClient
      .from('users')
      .select('*')
      .eq('id', req.authUser?.id ?? '')
      .maybeSingle()

    if (error) {
      throw error
    }

    res.json({ profile: data })
  }),
)

