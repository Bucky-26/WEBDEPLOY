#!/bin/bash

sudo ufw enable

sudo ufw allow ssh

sudo ufw allow 3001:4000/tcp

sudo ufw reload

# Show status
sudo ufw status
