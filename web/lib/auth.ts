import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import { checkDiscordRoles, RoleType } from "@/lib/auth-utils"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

const isProduction = process.env.NODE_ENV === 'production'
const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
const shouldTrustHost = process.env.AUTH_TRUST_HOST === 'true' || !!process.env.RAILWAY_ENVIRONMENT || process.env.VERCEL === '1'
const authBaseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL
const secureCookiePrefix = isProduction ? '__Secure-' : ''

function resolveCookieDomain(): string | undefined {
    const configuredDomain = process.env.AUTH_COOKIE_DOMAIN?.trim()
    if (configuredDomain) {
        return configuredDomain
    }

    if (!isProduction || !authBaseUrl) {
        return undefined
    }

    try {
        const hostname = new URL(authBaseUrl).hostname.toLowerCase()
        if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return undefined
        }
        return hostname.startsWith('www.') ? `.${hostname.slice(4)}` : `.${hostname}`
    } catch {
        return undefined
    }
}

const cookieDomain = resolveCookieDomain()
const sharedAuthCookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: isProduction,
    ...(cookieDomain ? { domain: cookieDomain } : {})
}

// Client Supabase pour le logging (lazy init pour éviter erreur au build)
let supabaseAdmin: SupabaseClient | null = null
function getSupabaseAdmin(): SupabaseClient | null {
    if (!supabaseAdmin && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
        supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        )
    }
    return supabaseAdmin
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: authSecret,
    trustHost: shouldTrustHost,
    useSecureCookies: isProduction,
    cookies: {
        pkceCodeVerifier: {
            name: `${secureCookiePrefix}authjs.pkce.code_verifier`,
            options: {
                ...sharedAuthCookieOptions,
                maxAge: 60 * 15
            }
        },
        state: {
            name: `${secureCookiePrefix}authjs.state`,
            options: {
                ...sharedAuthCookieOptions,
                maxAge: 60 * 15
            }
        },
        nonce: {
            name: `${secureCookiePrefix}authjs.nonce`,
            options: sharedAuthCookieOptions
        }
    },
    providers: [
        Discord({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: {
                params: {
                    // guilds.members.read permet de récupérer les rôles du membre
                    scope: "identify guilds.members.read",
                },
            },
        }),
    ],
    callbacks: {
        async jwt({ token, account, profile }) {
            // Première connexion : récupérer les infos Discord ET les rôles
            if (account && profile) {
                const discordProfile = profile as { id?: string; username?: string; avatar?: string }
                token.discord_id = discordProfile.id
                token.discord_username = discordProfile.username
                token.discord_avatar = discordProfile.avatar
                token.accessToken = account.access_token

                // Récupérer les rôles UNE SEULE FOIS à la connexion
                if (account.access_token) {
                    try {
                        const { roles, displayName, avatarUrl } = await checkDiscordRoles(account.access_token)
                        token.roles = roles
                        token.displayName = displayName || discordProfile.username || 'Inconnu'

                        // Créer/mettre à jour l'utilisateur dans la table users
                        const supabase = getSupabaseAdmin()
                        if (supabase && discordProfile.id) {
                            supabase.from('users').upsert({
                                discord_id: discordProfile.id,
                                discord_username: displayName || discordProfile.username || 'Inconnu',
                                avatar_url: avatarUrl || null,
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'discord_id'
                            }).then(({ error }) => {
                                if (error) console.error('[Auth] User upsert error:', error)
                            })
                        }

                        // Logger la connexion
                        getSupabaseAdmin()?.from('session_logs').insert({
                            user_discord_id: discordProfile.id,
                            user_name: displayName || discordProfile.username || 'Inconnu',
                            action: 'login',
                            metadata: {
                                roles: roles,
                                provider: 'discord'
                            }
                        }).then(({ error }) => {
                            if (error) console.error('[Auth] Session log error:', error)
                        })

                    } catch (error) {
                        console.error('[Auth] Error fetching roles at login:', error)
                        token.roles = []
                        token.displayName = discordProfile.username || 'Inconnu'
                    }
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.discord_id = token.discord_id as string
                session.user.discord_username = token.discord_username as string
                session.user.discord_avatar = token.discord_avatar as string
                session.user.roles = (token.roles as RoleType[]) || []
                session.user.displayName = (token.displayName as string) || 'Inconnu'
            }
            session.accessToken = token.accessToken as string
            return session
        },
    },
    pages: {
        signIn: "/auth/signin",
    },
    logger: {
        error(error) {
            console.error('[Auth][error]', error)
        },
        warn(code) {
            console.warn('[Auth][warn]', code)
        },
        debug(message, metadata) {
            if (!isProduction) {
                console.debug('[Auth][debug]', message, metadata ?? '')
            }
        }
    },
})
