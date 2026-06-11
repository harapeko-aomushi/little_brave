# Little Brave Browser Porting Checklist

This file tracks browser-side parity against `old/source`.
The goal is not "roughly similar", but "old implementation reviewed system by system".

## Scene Flow

- `Game.cpp`
  - `GameOpening`: partial
  - `GamePlay`: partial
  - `GameMenu`: missing
  - `GameOver`: partial
  - `GameEnding`: missing
  - `RoundTripAlpha` / scene fade: missing
  - `ChangeStageCheck` / staged reset flow: missing

## Core Gameplay Order

Old update order inside `PlayUpdate()`:

1. `GimmickMain`
2. `PlayerMain`
3. `WeaponMain`
4. `PBulletMain`
5. `BossMain`
6. `EnemyMain`
7. `EBulletMain`
8. `ItemMain`
9. `ComboMain`
10. `EfectMain`
11. `FairyMain`
12. `MapMain`

Current browser status:

- `MapMain`: partial
- `PlayerMain`: partial
- `WeaponMain`: missing
- `PBulletMain`: partial
- `BossMain`: missing
- `EnemyMain`: partial
- `EBulletMain`: missing
- `ItemMain`: missing
- `ComboMain`: missing
- `EfectMain`: missing
- `FairyMain`: partial
- `GimmickMain`: missing

## Gameplay Systems

- `Map.cpp`: partial
  - three stages not fully wired
  - front-chip draw missing
  - map hit helpers not mirrored
- `Player.cpp`: partial
  - normal 3-hit sword chain added
  - sword1/2/3 player animation now uses old 48px attack clips
  - double jump / damage invincibility / level+SP recovery added
  - bow mode missing
  - SP charge behavior missing
  - gimmick ride behavior partial
- `Fairy.cpp`: partial
  - follow behavior present
  - type toggle / weapon swap missing
- `Weapon.cpp`: missing
- `Weapon.cpp`: partial
  - sword1/2/3 timing and hit windows present
  - sword1/2/3 visual crops use original right/left rows
  - sword projectile specials partial
  - sword4/5 exact behavior missing
- `PlayerBullet.cpp`: partial
  - normal arrow / power arrow / sword projectiles added
  - projectile visual clips now use old variable-width animation coordinates
  - exact animation timing and map-hit behavior still partial
- `Enemy.cpp`: partial
  - full spawn table wired
  - bird / slime / liquid variants added
  - life gauge added
  - enemy bullet details still partial
- `EnemyBullet.cpp`: missing
- `Boss.cpp`: missing
- `Gimmick.cpp`: missing
- `Item.cpp`: missing
- `Combo.cpp`: missing
- `Efect.cpp`: missing
- `Efect.cpp`: partial
  - charge effect and hit shockwave added
- `Menu.cpp`: partial
  - portrait/HUD only
  - actual menu scene missing

## Data / Assets

- `data/Map1.txt`: wired
- `data/map2.txt`: copied, not wired
- `data/map3.txt`: copied, not wired
- `Image/PNG/*`: copied selectively into current runtime
- `Runtime/*`: intentionally excluded from git tracking

## Porting Rule

When a system is marked complete, it should be reviewed against the matching `old/source/*.cpp` and `*.h`, not only visually approximated.
