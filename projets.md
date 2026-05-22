---
layout: page
title: Projets & Expérimentations
description: Carnet de bord de mes projets en algorithmique, optimisation haute performance et architectures embarquées.
permalink: /projets/
---

<ul class="hermes-post-list" style="margin-top: 40px;">
  {% assign sortedPosts = site.posts | sort: 'date' | reverse %}
  {% for post in sortedPosts %}
  <li class="hermes-post-item">
    <div class="post-meta-row">
      <span class="post-date-cell">{% include date_fr.html date=post.date %}</span>
      {% if post.tags %}
      <div class="post-tags-cell">
        {% for tag in post.tags %}
        <span class="tag-badge tag-{{ tag | downcase | slugify }}">{{ tag }}</span>
        {% endfor %}
      </div>
      {% endif %}
    </div>
    <h3 class="post-title-cell">
      <a href="{{ post.url | prepend: site.baseurl }}">{{ post.title }}</a>
    </h3>
  </li>
  {% endfor %}
</ul>
