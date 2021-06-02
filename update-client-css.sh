#!/bin/bash

USAGE="$0: usage is: $0 lc-client-semver"

if [ $# -lt 1 ]
then
	echo $USAGE
	exit 2
fi

VERSION=$1

CSS_DIR=lib/public
NEW_CSS_PATH=$CSS_DIR/lc-client.$VERSION.css

URL="https://d35x2co4ayvx2v.cloudfront.net/build/${VERSION}/css/index.css"
curl -s -o ${NEW_CSS_PATH}.gz $URL

# if download succeeded
if [ $? -eq 0 ]
then
	echo -n "downloaded "
	ls ${NEW_CSS_PATH}.gz

	gunzip -v ${NEW_CSS_PATH}.gz

	# prompt to remove old versions
	for f in $CSS_DIR/lc-client.[0-9]*.css
	do
	  echo "processing $f..."
		if [ "$f" != "$NEW_CSS_PATH" ]
		then
			rm -v "$f"
		fi
	done

	# symlink new version
	ln -sf $NEW_CSS_PATH $CSS_DIR/lc-client.css
	git add $NEW_CSS_PATH $CSS_DIR/lc-client.css
fi

ls -lF $CSS_DIR/lc-client*.css
