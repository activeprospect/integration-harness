#!/bin/bash

USAGE="$0: usage is: $0 lc-client-semver"
BASE_URL="https://d35x2co4ayvx2v.cloudfront.net/build/LC_CLIENT_SEMVER/css/index.css"

if [ $# -lt 1 ]
then
	echo $USAGE
	exit 2
fi

VERSION=$1

CSS_DIR=lib/public
NEW_CSS_FILE=lc-client.$VERSION.css

URL=`echo $BASE_URL | sed "s/LC_CLIENT_SEMVER/$VERSION/"`
curl -o $CSS_DIR/$NEW_CSS_FILE $URL

# if download succeeded
if [ $? -eq 0 ]
then
	echo -n "downloaded "
	ls $NEW_CSS_FILE

	# prompt to remove old versions
	for f in $CSS_DIR/lc-client.*.css
	do
		if [ "$f" != "$CSS_DIR/$NEW_CSS_FILE" ]
		then
			rm -i "$f"
			if [ ! -f "$CSS_DIR/$NEW_CSS_FILE" ]
			then
				git rm "$f"
			fi
		fi
	done

	# symlink new version
	ln -sf $NEW_CSS_FILE $CSS_DIR/lc-client.css
fi

ls -lF $CSS_DIR/lc-client*.css
