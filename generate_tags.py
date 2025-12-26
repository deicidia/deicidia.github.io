import os
import re
import yaml

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')

def generate_tag_pages():
    posts_dir = '_posts'
    tags_dir = 'tag'
    all_tags = set()

    # 1. Collect all tags from posts
    for filename in os.listdir(posts_dir):
        if filename.endswith('.md') or filename.endswith('.markdown'):
            with open(os.path.join(posts_dir, filename), 'r', encoding='utf-8') as f:
                content = f.read()
                # Extract frontmatter
                match = re.search(r'^---\s*\n(.*?)\n---', content, re.DOTALL)
                if match:
                    frontmatter = yaml.safe_load(match.group(1))
                    if 'tags' in frontmatter:
                        tags = frontmatter['tags']
                        if isinstance(tags, list):
                            all_tags.update(tags)
                        else:
                            all_tags.add(tags)

    # 2. Generate folders and index.html for each tag
    for tag in all_tags:
        tag_slug = slugify(tag)
        tag_path = os.path.join(tags_dir, tag_slug)
        os.makedirs(tag_path, exist_ok=True)
        
        index_content = f"""---
layout: tag
title: "Tag: {tag}"
tag_slug: "{tag_slug}"
permalink: /tag/{tag_slug}/
---
"""
        with open(os.path.join(tag_path, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(index_content)
        
        print(f"Generated page for tag: {tag} ({tag_slug})")

if __name__ == "__main__":
    generate_tag_pages()
