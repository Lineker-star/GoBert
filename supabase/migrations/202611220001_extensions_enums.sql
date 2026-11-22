-- migrations/0001_extensions.sql
create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- enums
do $$ begin
  create type user_role as enum ('passenger','provider','admin','support');
exception when duplicate_object then null; end $$;
do $$ begin
  create type vehicle_type as enum ('moto','taxi','tricycle','truck','car_rental','van','bus');
exception when duplicate_object then null; end $$;
do $$ begin
  create type service_type as enum ('ride','moto','express','cargo','rent','travel');
exception when duplicate_object then null; end $$;
do $$ begin
  create type verification_status as enum ('draft','pending','approved','rejected','suspended');
exception when duplicate_object then null; end $$;
do $$ begin
  create type booking_status as enum ('requested','offered','accepted','arriving','in_progress','completed','cancelled','expired','no_show');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_method as enum ('cash','mtn_momo','orange_money');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_status as enum ('pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;
