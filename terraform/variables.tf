variable "aws_region" {
    type = string
    default = "us-east-1"
}

variable "vpc_cidr" {
    type = string
    default = "10.0.0.0/16"
}
 
variable "availability_zones" {
    type = list(string)
    default = ["us-east-1a", "us-east-1b"]
}

variable "public_subnets" {
    type = map(string)
    default = {
        web-public-subnet-1a = "10.0.1.0/24"
        web-public-subnet-1b = "10.0.2.0/24"
    }
}

variable "app_private_subnets" {
    type = map(string)
    default ={
        app-private-subnet-1a = "10.0.3.0/24"
        app-private-subnet-1b = "10.0.4.0/24"
    }
}

variable "db_private_subnets" {
    type = map(string)
    default = {
        data-private-subnet-1a = "10.0.5.0/24"
        data-private-subnet-1b = "10.0.6.0/24"
    }
}

variable "ssh_port" {
    type = number
    default = 22
}

variable "http_port" {
    type = number
    default = 80
}

variable "app_port" {
    type = number
    default = 4000
}

variable "db_port" {
    type = number
    default = 27017
}

variable "backend_from" {
    type = number
    default = 4001
}

variable "backend_to" {
    type = number
    default = 4006
}

variable "ami_id" {
    type = string
    default = "ami-091138d0f0d41ff90"
}

variable "key_name" {
    type = string
    default = "three-tier-arch"
}