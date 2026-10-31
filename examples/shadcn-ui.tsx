"use client";
import type { HankoIdentityUI } from "@alien6-studio/hankoshell-typescript-adk/identity/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Hanko owns IAM behavior. These components and design tokens belong to the application.
export const hankoIdentityUI: HankoIdentityUI = {
  Page: ({ title, description, children }) => (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </div>
  ),
  Section: ({ title, children }) => (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "space-y-6" : "space-y-6 pt-6"}>
        {children}
      </CardContent>
    </Card>
  ),
  Group: ({ inline, children }) => (
    <div className={inline ? "flex flex-wrap items-center gap-3" : "space-y-5"}>
      {children}
    </div>
  ),
  Field: ({ label, htmlFor, children }) => (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  ),
  Input,
  Textarea,
  Select: ({ id, value, onValueChange, options, disabled }) => (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ),
  Button: ({ tone, ...props }) => (
    <Button
      {...props}
      variant={
        tone === "danger"
          ? "destructive"
          : tone === "secondary"
            ? "outline"
            : "default"
      }
    />
  ),
  Status: ({ role, kind, children }) => (
    <div
      role={role}
      className={
        kind === "error"
          ? "flex flex-wrap items-center gap-3 text-sm text-destructive"
          : "flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
      }
    >
      {children}
    </div>
  ),
  Values: ({ items }) => (
    <dl className="grid gap-5 sm:grid-cols-2">
      {items.map((item, index) => (
        <div className="min-w-0" key={index}>
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  ),
  Members: ({ members, renderActions, labels }) => (
    <ul aria-label={labels.name} className="divide-y divide-border">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-foreground">
              {member.name}
            </p>
            {member.email && (
              <p className="break-all text-sm text-muted-foreground">
                {member.email}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {labels.role} : {member.role}
            </p>
          </div>
          {renderActions && (
            <div
              aria-label={`${labels.actions} — ${member.name}`}
              className="w-full sm:w-auto"
            >
              {renderActions(member)}
            </div>
          )}
        </li>
      ))}
    </ul>
  ),
};
