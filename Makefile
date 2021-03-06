.PHONY: clean

DIST := ./dist
ASSETS := ./assets
resolutions := 48 72 96 144 192 512
ALL_ICONS := $(foreach resolution, $(resolutions), $(DIST)/icon_$(resolution).png)

all: clean copy_assets images $(DIST)/script.js $(DIST)/sw.js

copy_assets:
	cp $(ASSETS)/* $(DIST)

$(DIST)/script.js:
	./node_modules/.bin/esbuild src/index.ts --bundle --outfile=$@

$(DIST)/sw.js: workbox-config.js
	workbox generateSW $<

images: $(ALL_ICONS)

$(DIST)/icon_%.png: $(ASSETS)/favicon.svg
	inkscape $< -w $* -h $* --export-type=png --export-filename=$@

clean:
	rm -f $(DIST)/*