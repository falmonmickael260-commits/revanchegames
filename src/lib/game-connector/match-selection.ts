import type { PublicGameRoom } from "./public-rooms";
export function matchingRooms(rooms:PublicGameRoom[],slug:string,allowed:readonly string[]){
 return rooms.filter(r=>allowed.includes(r.game_slug)&&(slug==="any"||r.game_slug===slug)&&!r.isHost&&Number.isInteger(r.player_count)&&Number.isInteger(r.capacity)&&r.player_count>=1&&r.capacity>r.player_count)
 .sort((a,b)=>(b.player_count/b.capacity)-(a.player_count/a.capacity)||a.id.localeCompare(b.id));
}
