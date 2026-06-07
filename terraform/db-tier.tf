resource "aws_instance" "database" {
  ami           = var.ami_id
  instance_type = "t2.micro"
  key_name      = var.key_name

  subnet_id = aws_subnet.app_private_subnets["app-private-subnet-1a"].id

  vpc_security_group_ids = [
    aws_security_group.app-sg.id
  ]

  associate_public_ip_address = false

  user_data = <<-EOF
#!/bin/bash

apt-get update -y

apt-get install -y docker.io

systemctl enable docker
systemctl start docker

docker pull mongo

docker run -d \
  --name mongodb \
  -p 27017:27017 \
  --restart unless-stopped \
  mongo

EOF

  tags = {
    Name = "Database"
  }
}