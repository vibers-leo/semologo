/** Public-page visibility. Logo wall editing/sharing never mounts a video rail. */
export function storyRailMode(pathname){
 const path=(pathname||'/').replace(/^\/en(?=\/|$)/,'').replace(/\/+$/,'')||'/';
 if(/^\/logo-walls(?:\/|$)/.test(path)||/^\/(?:admin|login|auth|api)(?:\/|$)/.test(path))return 'off';
 return path==='/'?'collapsed':'expanded';
}
