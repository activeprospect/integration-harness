#!/bin/bash

USAGE="$0: usage is: $0 lc-client-semver"

if [ $# -lt 1 ]
then
	echo $USAGE
	exit 2
fi

VERSION=$1

CSS_DIR=lib/public
NEW_CSS_FILE=lc-client.$VERSION.css
NEW_CSS_PATH=$CSS_DIR/$NEW_CSS_FILE

URL="https://d35x2co4ayvx2v.cloudfront.net/build/${VERSION}/css/index.css"
curl -s -o ${NEW_CSS_PATH}.gz $URL

# if download succeeded
if [ $? -eq 0 ]
then
	echo -n "downloaded "
	ls ${NEW_CSS_PATH}.gz

	gunzip -v ${NEW_CSS_PATH}.gz

	# remove old versions
	for f in $CSS_DIR/lc-client.[0-9]*.css
	do
		if [ "$f" != "$NEW_CSS_PATH" ]
		then
			git rm "$f"
		fi
	done

	# symlink new version
	cd $CSS_DIR
	ln -sf $NEW_CSS_FILE lc-client.css
	cd -
	git add $NEW_CSS_PATH $CSS_DIR/lc-client.css
fi

ls -lF $CSS_DIR/lc-client*.css
