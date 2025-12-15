import NextAuth from "next-auth"
import Discord from "next-auth/providers/discord"
import { checkDiscordRoles, RoleType } from "@/lib/auth-utils"

export const { handlers, signIn, signOut, auth } = NextAuth({
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
                        const { roles, displayName } = await checkDiscordRoles(account.access_token)
                        token.roles = roles
                        token.displayName = displayName || discordProfile.username || 'Inconnu'
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
})
