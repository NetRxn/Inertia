export interface OutboundComments {
    enabled: boolean;
    audienceAcknowledged: boolean;
    notBefore: string;
}
export interface Binding {
    outboundComments?: OutboundComments;
    relay: string;
    channelId: string;
    rootId: string;
    companyId: string;
    issueId: string;
}
export interface Pairing {
    relay: string;
    companyId: string;
    pubkey: string;
    actorUserId: string;
    kind: 'human' | 'agent';
    active: boolean;
}
export interface DecisionCard {
    token: string;
    companyId: string;
    issueId: string;
    interactionId: string;
    digest: string;
}
export interface TrustedBridgeConfig {
    companyId?: string;
    relay: string;
    bridgePubkey: string;
    bindings: readonly Binding[];
    pairings: readonly Pairing[];
    cards: readonly DecisionCard[];
    maxCommentBytes?: number;
}
interface CommandBase {
    binding: Binding;
    actorUserId: string;
    sourceEventId: string;
    authorPubkey: string;
}
export interface CommentCommand extends CommandBase {
    kind: 'comment';
    body: string;
}
export interface InteractionCommand extends CommandBase {
    kind: 'interactionResponse';
    action: 'accept' | 'reject';
    card: DecisionCard;
}
export type BridgeCommand = CommentCommand | InteractionCommand;
export interface Rejection {
    kind: 'rejection';
    code: string;
    message: string;
}
