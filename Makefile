resolutions := 48 72 96 144 192 512
ALL_ICONS := $(foreach resolution, $(resolutions), icon_$(resolution).png)

all: index.html images script.js sw.js

index.html:

script.js: script.ts tsconfig.json
	tsc

sw.js: workbox-config.js script.js $(ALL_ICONS) index.html
	workbox generateSW $<

images: $(ALL_ICONS)

icon_%.png: favicon.svg
	inkscape $< -w $* -h $* --export-type=png --export-filename=$@
