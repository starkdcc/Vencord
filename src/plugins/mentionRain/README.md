# MentionRain

rain start falling on screen when someon mention u with @ in discord. setting let u change how many drop how long it rian and color of drop

## install

put this folder in vencord src/userplugin/ folder and rebuild with pnpm build. then enable mentionrain from vencord settig -> plugins

## settings

- drops: how many raindrop fall (defualt 80)
- seconds: how long it rian (default 3)
- color: any css color for the drops (default light blue)

## how it work

listen to MESSAGE_CREATE event in fluxdispatcher . if someon mention u with @ then it render canvas overaly with raindrop falling then clean it up after duraiton end
